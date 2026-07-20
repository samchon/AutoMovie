import { IAutoMovieStagingApplication } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staging = makeStagingWrite();

type StageSpace = IAutoMovieStagingApplication.IWrite["space"];
type StageSet = IAutoMovieStagingApplication.IWrite["set"];

const stageWith = (
  override: Partial<IAutoMovieStagingApplication.IWrite>,
): ReturnType<AutoMovieApplication["stage"]>["staged"] =>
  app.stage({ script, staging: { ...staging, ...override } }).staged;

const spaceWith = (space: unknown) => stageWith({ space: space as StageSpace });

const surface = (partial: Record<string, unknown> = {}) => ({
  id: "floor",
  kind: "floor",
  polygon: [
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
  ],
  anchor: { x: 0, y: 0, z: 0 },
  rampTo: null,
  ...partial,
});

/**
 * The MCP `stage` tool's structural floor for the new environment fields
 * (#1173): a space is the only staging payload with an array of objects each
 * holding a further array of vectors, so a malformed one would reach
 * `surface.polygon.forEach` or `surface.rampTo.x` inside the engine as a throw
 * instead of a field-located violation. `scale` is the same class one level
 * down: the engine lowers it as either a number or a vector and nothing else.
 *
 * Scenarios:
 *
 * 1. A non-object space, and a space whose `id`, `surfaces`, and `walkable` are
 *    the wrong JSON types, each fail at their own submitted path.
 * 2. Inside a surface: a non-object entry, a non-string `id`/`kind`, a non-array
 *    `polygon`, a non-object footprint point, a non-object `anchor`, and an
 *    OMITTED `rampTo` (which the height query would read as a ramp and
 *    dereference) all fail at their paths.
 * 3. A non-string walkable id fails at its index.
 * 4. A set `scale` that is neither a number nor an object fails at its path.
 * 5. The positive twin: a well-formed space and both `scale` forms pass the shape
 *    gate and reach the engine, which stages them, so none of the gates above
 *    is an over-match on valid input, and an explicitly `null` `rampTo` is a
 *    flat patch rather than a missing field.
 */
export const test_mcp_stage_space_shape = (): void => {
  TestValidator.predicate(
    "a non-object space fails at its path",
    hasViolation(spaceWith(5), "type", "$input.staging.space"),
  );

  const badRoot = spaceWith({ id: 5, surfaces: 5, walkable: 5 });
  TestValidator.predicate(
    "a space's id, surfaces, and walkable are typed at their paths",
    hasViolation(badRoot, "type", "$input.staging.space.id") &&
      hasViolation(badRoot, "type", "$input.staging.space.surfaces") &&
      hasViolation(badRoot, "type", "$input.staging.space.walkable"),
  );

  const badSurfaces = spaceWith({
    id: "space-1",
    surfaces: [
      null,
      surface({ id: 5, kind: 5 }),
      surface({ polygon: 5 }),
      surface({ polygon: [{ x: 0, y: 0, z: 0 }, null, { x: 1, y: 0, z: 1 }] }),
      surface({ anchor: 5 }),
      surface({ rampTo: undefined }),
    ],
    walkable: [],
  });
  TestValidator.predicate(
    "every malformed surface field fails at its own path",
    hasViolation(badSurfaces, "type", "$input.staging.space.surfaces[0]") &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[1].id",
      ) &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[1].kind",
      ) &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[2].polygon",
      ) &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[3].polygon[1]",
      ) &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[4].anchor",
      ) &&
      hasViolation(
        badSurfaces,
        "type",
        "$input.staging.space.surfaces[5].rampTo",
      ),
  );

  const badWalkable = spaceWith({
    id: "space-1",
    surfaces: [],
    walkable: ["floor", 5],
  });
  TestValidator.predicate(
    "a non-string walkable id fails at its index",
    hasViolation(badWalkable, "type", "$input.staging.space.walkable[1]"),
  );

  const badScale = stageWith({
    set: [
      {
        node: "slab",
        model: "slab",
        position: { x: 0, y: 0, z: 0 },
        scale: "big",
      },
    ] as unknown as StageSet,
  });
  TestValidator.predicate(
    "a set scale that is neither number nor vector fails at its path",
    hasViolation(badScale, "type", "$input.staging.set[0].scale"),
  );

  // 5. the positive twin: valid shapes stage clean.
  const staged = stageWith({
    space: {
      id: "space-1",
      surfaces: [
        {
          id: "floor",
          kind: "floor",
          polygon: [
            { x: -1, y: 0, z: -1 },
            { x: 1, y: 0, z: -1 },
            { x: 1, y: 0, z: 1 },
          ],
          anchor: { x: 0, y: 0, z: 0 },
          rampTo: null,
        },
      ],
      walkable: ["floor"],
    },
    set: [
      {
        node: "slab",
        model: "slab",
        position: { x: 0, y: 0, z: 0 },
        scale: 2,
      },
      {
        node: "wall",
        model: "slab",
        position: { x: 0, y: 0, z: 2 },
        scale: { x: 4, y: 2, z: 0.2 },
      },
    ],
  });
  TestValidator.equals(
    "a well-formed space and both scale forms stage",
    staged.success,
    true,
  );
  TestValidator.equals(
    "the staged scene carries the space",
    staged.success === true ? (staged.scene.space?.id ?? null) : null,
    "space-1",
  );
};
