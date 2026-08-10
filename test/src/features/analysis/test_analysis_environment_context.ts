import {
  assertAutoMovieAnalysisSolids,
  autoMovieContextSolids,
  autoMovieEnvironmentInstant,
  autoMovieHemisphereDirections,
  autoMovieRayObstructed,
  autoMovieSkyward,
  autoMovieSolidBlocks,
  validateAutoMovieEnvironmentContext,
} from "@automovie/engine";
import {
  IAutoMovieEnvironmentContext,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { analysisContext, boxSolid } from "../internal/analysisFixtures";
import {
  hasViolation,
  namedFacts,
  nclose,
  throwsError,
} from "../internal/predicates";

/**
 * The read-only world an analysis reads is validated as context and never as
 * geometry the building owns.
 *
 * The two rules this scenario exists for are the ones a data-only contract
 * would have skipped. A sun at or below the reference horizon may not declare a
 * beam, because a source under the ground illuminates nothing and a declared
 * beam there turns a study into fiction. And no context id may collide with a
 * building-owned id, because the moment a neighbour's mass is addressable as
 * part of the work, "read-only external context" is a comment rather than a
 * boundary.
 *
 * The occlusion test is analytic, so every expectation below is hand geometry
 * over the slab interval, not a snapshot: a ray from inside a box is blocked at
 * once, a ray that leaves a box exactly at its face is not blocked at all, and
 * a ray shorter than the entry parameter never reaches it.
 *
 * Scenarios:
 *
 * 1. The declared site validates clean, and its instants, occluders and solids
 *    read back exactly as declared.
 * 2. Every field of the context has a refusing twin: version, units, blank id,
 *    zero and non-finite directions, non-finite elevation, blank and duplicated
 *    instant ids, non-finite and non-increasing time, negative and non-finite
 *    illuminance, out-of-range humidity, non-finite outdoor temperature.
 * 3. A sun below the horizon with a beam is refused; the same sun with no beam is
 *    accepted, and so is a sun above the horizon with a beam.
 * 4. A context id, an instant id and an occluder id colliding with a
 *    building-owned id are each refused; the same context beside unrelated
 *    building ids is accepted.
 * 5. An occluder of fewer than four half-spaces, with a zero normal, or with a
 *    non-finite offset is refused, and the assertion form of the same rule
 *    throws on a blank id, a duplicate id and a malformed plane.
 * 6. The slab test answers hand geometry: inside, ahead, behind, parallel outside,
 *    parallel inside, beyond the ray's own length, and exactly tangent at the
 *    origin.
 * 7. Cosine-weighted hemisphere directions are unit length, strictly inside the
 *    hemisphere of their normal for both signs of its z, and refuse a
 *    fractional, zero or negative count and a zero normal.
 */
export const test_analysis_environment_context = (): void => {
  const context = analysisContext();
  TestValidator.equals(
    "the declared site validates clean",
    validateAutoMovieEnvironmentContext({ context }),
    { success: true },
  );
  TestValidator.equals(
    "an instant is found by id and absent ids read as null",
    [
      autoMovieEnvironmentInstant(context, "noon")?.label,
      autoMovieEnvironmentInstant(context, "dawn"),
    ],
    ["equinox-1200", null],
  );

  const neighbour = boxSolid(
    "neighbour",
    { x: 2, y: 0, z: -2 },
    { x: 4, y: 10, z: 2 },
  );
  const occluded = analysisContext({
    occluders: [{ ...neighbour, kind: "neighbour-tower" }],
  });
  TestValidator.equals(
    "context occluders convert to analysis solids without gaining ownership",
    autoMovieContextSolids(occluded).map((solid) => [
      solid.id,
      solid.planes.length,
    ]),
    [["neighbour", 6]],
  );

  const broken = (
    overrides: Partial<IAutoMovieEnvironmentContext>,
  ): ReturnType<typeof validateAutoMovieEnvironmentContext> =>
    validateAutoMovieEnvironmentContext({
      context: analysisContext(overrides),
    });
  const instantOf = (
    index: number,
    patch: Partial<IAutoMovieEnvironmentContext["instants"][number]>,
  ): IAutoMovieEnvironmentContext["instants"] => {
    const instants = analysisContext().instants;
    instants[index] = { ...instants[index]!, ...patch };
    return instants;
  };
  TestValidator.equals(
    "every declared field of the context has a refusing twin",
    namedFacts([
      [
        "version",
        () =>
          hasViolation(
            broken({ version: 2 as unknown as 1 }),
            "type",
            "version",
          ),
      ],
      [
        "units",
        () =>
          hasViolation(
            broken({ units: "foot" as unknown as "meter" }),
            "type",
            "$input.units",
          ),
      ],
      [
        "blank id",
        () => hasViolation(broken({ id: "  " }), "type", "$input.id"),
      ],
      [
        "zero north",
        () =>
          hasViolation(
            broken({ north: { x: 0, y: 0, z: 0 } }),
            "range",
            "north",
          ),
      ],
      [
        "non-finite north",
        () =>
          hasViolation(
            broken({ north: { x: Number.NaN, y: 0, z: -1 } }),
            "range",
            "north.x",
          ),
      ],
      [
        "zero ground up",
        () =>
          hasViolation(
            broken({ ground: { up: { x: 0, y: 0, z: 0 }, elevation: 0 } }),
            "range",
            "ground.up",
          ),
      ],
      [
        "non-finite elevation",
        () =>
          hasViolation(
            broken({
              ground: { up: { x: 0, y: 1, z: 0 }, elevation: Number.NaN },
            }),
            "range",
            "ground.elevation",
          ),
      ],
      [
        "blank instant id",
        () =>
          hasViolation(
            broken({ instants: instantOf(0, { id: " " }) }),
            "type",
            "instants[0].id",
          ),
      ],
      [
        "blank instant label",
        () =>
          hasViolation(
            broken({ instants: instantOf(0, { label: "" }) }),
            "type",
            "instants[0].label",
          ),
      ],
      [
        "duplicate instant id",
        () =>
          hasViolation(
            broken({ instants: instantOf(1, { id: "noon" }) }),
            "type",
            "instants[1].id",
          ),
      ],
      [
        "non-finite instant time",
        () =>
          hasViolation(
            broken({ instants: instantOf(0, { time: Number.NaN }) }),
            "range",
            "instants[0].time",
          ),
      ],
      [
        "non-increasing instant time",
        () =>
          hasViolation(
            broken({ instants: instantOf(1, { time: -10 }) }),
            "range",
            "instants[1].time",
          ),
      ],
      [
        "zero sun",
        () =>
          hasViolation(
            broken({ instants: instantOf(0, { sun: { x: 0, y: 0, z: 0 } }) }),
            "range",
            "instants[0].sun",
          ),
      ],
      [
        "negative beam",
        () =>
          hasViolation(
            broken({
              instants: instantOf(0, { directNormalIlluminance: -1 }),
            }),
            "range",
            "instants[0].directNormalIlluminance",
          ),
      ],
      [
        "non-finite beam",
        () =>
          hasViolation(
            broken({
              instants: instantOf(0, { directNormalIlluminance: Number.NaN }),
            }),
            "range",
            "instants[0].directNormalIlluminance",
          ),
      ],
      [
        "negative sky",
        () =>
          hasViolation(
            broken({
              instants: instantOf(0, { diffuseHorizontalIlluminance: -5 }),
            }),
            "range",
            "instants[0].diffuseHorizontalIlluminance",
          ),
      ],
      [
        "non-finite outdoor temperature",
        () =>
          hasViolation(
            broken({
              instants: instantOf(0, { outdoorAirTemperature: Number.NaN }),
            }),
            "range",
            "instants[0].outdoorAirTemperature",
          ),
      ],
      [
        "out of range humidity",
        () =>
          hasViolation(
            broken({
              instants: instantOf(0, { outdoorRelativeHumidity: 1.5 }),
            }),
            "range",
            "instants[0].outdoorRelativeHumidity",
          ),
      ],
    ]),
    {
      version: true,
      units: true,
      "blank id": true,
      "zero north": true,
      "non-finite north": true,
      "zero ground up": true,
      "non-finite elevation": true,
      "blank instant id": true,
      "blank instant label": true,
      "duplicate instant id": true,
      "non-finite instant time": true,
      "non-increasing instant time": true,
      "zero sun": true,
      "negative beam": true,
      "non-finite beam": true,
      "negative sky": true,
      "non-finite outdoor temperature": true,
      "out of range humidity": true,
    },
  );

  TestValidator.equals(
    "a sun under the horizon may not declare a beam, and the same sun without one may",
    {
      beamBelow: hasViolation(
        broken({
          instants: instantOf(2, { directNormalIlluminance: 700 }),
        }),
        "range",
        "instants[2].directNormalIlluminance",
      ),
      // The night instant already declares a sun below the horizon and no beam;
      // it is the negative twin of the case above and must stay clean.
      darkBelow: validateAutoMovieEnvironmentContext({ context }).success,
      // A zero ground direction must report itself rather than produce a second
      // complaint about the beam that reads it.
      unusableGround: hasViolation(
        broken({
          ground: { up: { x: 0, y: 0, z: 0 }, elevation: 0 },
          instants: instantOf(2, { directNormalIlluminance: 700 }),
        }),
        "range",
        "instants[2].directNormalIlluminance",
      ),
    },
    { beamBelow: true, darkBelow: true, unusableGround: false },
  );

  TestValidator.equals(
    "no context id may collide with a building-owned id",
    {
      site: hasViolation(
        validateAutoMovieEnvironmentContext({
          context,
          reserved: ["site"],
        }),
        "type",
        "$input.id",
      ),
      instant: hasViolation(
        validateAutoMovieEnvironmentContext({
          context,
          reserved: ["noon"],
        }),
        "type",
        "instants[0].id",
      ),
      occluder: hasViolation(
        validateAutoMovieEnvironmentContext({
          context: occluded,
          reserved: ["neighbour"],
        }),
        "type",
        "occluders[0].id",
      ),
      unrelated: validateAutoMovieEnvironmentContext({
        context: occluded,
        reserved: ["tower/hall-wall", "space:tower/hall"],
      }).success,
    },
    { site: true, instant: true, occluder: true, unrelated: true },
  );

  TestValidator.equals(
    "an occluder that bounds nothing is refused, and the assertion form throws",
    namedFacts([
      [
        "blank occluder id",
        () =>
          hasViolation(
            broken({
              occluders: [{ id: " ", kind: "mass", planes: neighbour.planes }],
            }),
            "type",
            "occluders[0].id",
          ),
      ],
      [
        "blank occluder kind",
        () =>
          hasViolation(
            broken({
              occluders: [{ id: "a", kind: "", planes: neighbour.planes }],
            }),
            "type",
            "occluders[0].kind",
          ),
      ],
      [
        "duplicate occluder id",
        () =>
          hasViolation(
            broken({
              occluders: [
                { id: "a", kind: "mass", planes: neighbour.planes },
                { id: "a", kind: "mass", planes: neighbour.planes },
              ],
            }),
            "type",
            "occluders[1].id",
          ),
      ],
      [
        "three half-spaces",
        () =>
          hasViolation(
            broken({
              occluders: [
                {
                  id: "a",
                  kind: "mass",
                  planes: neighbour.planes.slice(0, 3),
                },
              ],
            }),
            "range",
            "occluders[0].planes",
          ),
      ],
      [
        "zero plane normal",
        () =>
          hasViolation(
            broken({
              occluders: [
                {
                  id: "a",
                  kind: "mass",
                  planes: [
                    { normal: { x: 0, y: 0, z: 0 }, offset: 1 },
                    ...neighbour.planes.slice(1),
                  ],
                },
              ],
            }),
            "range",
            "occluders[0].planes[0]",
          ),
      ],
      [
        "non-finite plane offset",
        () =>
          hasViolation(
            broken({
              occluders: [
                {
                  id: "a",
                  kind: "mass",
                  planes: [
                    { normal: { x: 1, y: 0, z: 0 }, offset: Number.NaN },
                    ...neighbour.planes.slice(1),
                  ],
                },
              ],
            }),
            "range",
            "occluders[0].planes[0].offset",
          ),
      ],
      [
        "assertion accepts the declared mass",
        () => {
          assertAutoMovieAnalysisSolids([neighbour], "shading solid");
          return true;
        },
      ],
      [
        "assertion refuses a blank id",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisSolids(
                [{ ...neighbour, id: "" }],
                "shading solid",
              ),
            "non-blank id",
          ),
      ],
      [
        "assertion refuses a duplicate id",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisSolids(
                [neighbour, neighbour],
                "shading solid",
              ),
            "declared twice",
          ),
      ],
      [
        "assertion refuses a malformed plane",
        () =>
          throwsError(
            () =>
              assertAutoMovieAnalysisSolids(
                [
                  {
                    id: "flat",
                    planes: [{ normal: { x: 0, y: 0, z: 0 }, offset: 0 }],
                  },
                ],
                "shading solid",
              ),
            "is malformed at",
          ),
      ],
    ]),
    {
      "blank occluder id": true,
      "blank occluder kind": true,
      "duplicate occluder id": true,
      "three half-spaces": true,
      "zero plane normal": true,
      "non-finite plane offset": true,
      "assertion accepts the declared mass": true,
      "assertion refuses a blank id": true,
      "assertion refuses a duplicate id": true,
      "assertion refuses a malformed plane": true,
    },
  );

  // A unit cube from (0,0,0) to (1,1,1), read from points whose relationship to
  // it is decided by hand rather than by running the routine.
  const cube = boxSolid("cube", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
  const shoot = (
    origin: IAutoMovieVector3,
    direction: IAutoMovieVector3,
    maxDistance = Infinity,
  ): boolean =>
    autoMovieSolidBlocks({
      origin,
      direction,
      planes: cube.planes,
      maxDistance,
    });
  TestValidator.equals(
    "the slab test answers hand geometry on every side of the interval",
    {
      inside: shoot({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }),
      ahead: shoot({ x: -1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }),
      behind: shoot({ x: -1, y: 0.5, z: 0.5 }, { x: -1, y: 0, z: 0 }),
      parallelOutside: shoot({ x: 0.5, y: 2, z: 0.5 }, { x: 1, y: 0, z: 0 }),
      parallelInside: shoot({ x: -1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }),
      // The near face sits at t = 1 and the ray is only half that long.
      tooShort: shoot({ x: -1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 0.5),
      // Exactly long enough to touch the near face.
      justLongEnough: shoot({ x: -1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 1),
      // Leaves the box exactly at the origin: an exit parameter of zero is not
      // an obstruction.
      tangentAtOrigin: shoot({ x: 1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }),
      diagonalMiss: shoot({ x: -1, y: -1, z: 0.5 }, { x: 0, y: 1, z: 0 }),
    },
    {
      inside: true,
      ahead: true,
      behind: false,
      parallelOutside: false,
      parallelInside: true,
      tooShort: false,
      justLongEnough: true,
      tangentAtOrigin: false,
      diagonalMiss: false,
    },
  );
  TestValidator.equals(
    "a ray is obstructed when any one solid stops it",
    {
      none: autoMovieRayObstructed({
        origin: { x: -1, y: 0.5, z: 0.5 },
        direction: { x: -1, y: 0, z: 0 },
        solids: [cube, neighbour],
        maxDistance: Infinity,
      }),
      one: autoMovieRayObstructed({
        origin: { x: -1, y: 0.5, z: 0.5 },
        direction: { x: 1, y: 0, z: 0 },
        solids: [cube, neighbour],
        maxDistance: Infinity,
      }),
      empty: autoMovieRayObstructed({
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 1, z: 0 },
        solids: [],
        maxDistance: Infinity,
      }),
    },
    { none: false, one: true, empty: false },
  );
  TestValidator.equals(
    "the reference ground decides which directions are sky",
    {
      up: autoMovieSkyward({ x: 0, y: 1, z: 0 }, context.ground),
      down: autoMovieSkyward({ x: 0, y: -1, z: 0 }, context.ground),
      grazing: autoMovieSkyward({ x: 1, y: 0, z: 0 }, context.ground),
    },
    { up: true, down: false, grazing: false },
  );

  const sampled = (normal: IAutoMovieVector3, count: number): boolean => {
    const directions = autoMovieHemisphereDirections({ normal, count });
    return (
      directions.length === count &&
      directions.every(
        (direction) =>
          nclose(Math.hypot(direction.x, direction.y, direction.z), 1, 1e-9) &&
          direction.x * normal.x +
            direction.y * normal.y +
            direction.z * normal.z >
            0,
      )
    );
  };
  TestValidator.equals(
    "cosine-weighted directions stay unit length inside their own hemisphere",
    namedFacts([
      ["positive z normal", () => sampled({ x: 0, y: 0, z: 1 }, 64)],
      ["negative z normal", () => sampled({ x: 0, y: 0, z: -1 }, 64)],
      ["oblique normal", () => sampled({ x: 1, y: 2, z: -2 }, 32)],
      ["single direction", () => sampled({ x: 0, y: 1, z: 0 }, 1)],
      [
        "deterministic",
        () => {
          const first = autoMovieHemisphereDirections({
            normal: { x: 0, y: 1, z: 0 },
            count: 8,
          });
          const second = autoMovieHemisphereDirections({
            normal: { x: 0, y: 1, z: 0 },
            count: 8,
          });
          return JSON.stringify(first) === JSON.stringify(second);
        },
      ],
      [
        "fractional count",
        () =>
          throwsError(
            () =>
              autoMovieHemisphereDirections({
                normal: { x: 0, y: 1, z: 0 },
                count: 1.5,
              }),
            "positive safe integer",
          ),
      ],
      [
        "zero count",
        () =>
          throwsError(
            () =>
              autoMovieHemisphereDirections({
                normal: { x: 0, y: 1, z: 0 },
                count: 0,
              }),
            "positive safe integer",
          ),
      ],
      [
        "zero normal",
        () =>
          throwsError(
            () =>
              autoMovieHemisphereDirections({
                normal: { x: 0, y: 0, z: 0 },
                count: 4,
              }),
            "non-zero normal",
          ),
      ],
    ]),
    {
      "positive z normal": true,
      "negative z normal": true,
      "oblique normal": true,
      "single direction": true,
      deterministic: true,
      "fractional count": true,
      "zero count": true,
      "zero normal": true,
    },
  );
};
