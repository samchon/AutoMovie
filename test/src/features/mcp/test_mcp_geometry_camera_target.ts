import {
  IAutoMovieScene,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpGeometryContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { nclose, throwsError, vclose } from "../internal/predicates";

const app = new AutoMovieApplication();
const skeleton = createSkeleton();

const at = (translation: IAutoMovieVector3): IAutoMovieTransform => ({
  translation,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const ACTOR: IAutoMovieVector3 = { x: 1, y: 0, z: 2 };
const MARKER: IAutoMovieVector3 = { x: 4, y: 0, z: 2 };
const LENS: IAutoMovieVector3 = { x: 0, y: 1.5, z: 5 };

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: at(ACTOR),
      motion: null,
      pose: null,
    },
    {
      id: "marker",
      model: "prop-model",
      transform: at(MARKER),
      motion: null,
      pose: null,
    },
  ],
  cameras: [
    { id: "camera", transform: at(LENS), fovY: 45, near: 0.1, far: 100 },
  ],
  lights: [],
};

const context: IAutoMovieMcpGeometryContext = {
  scene,
  models: [
    { id: "actor-model", skeleton },
    { id: "prop-model", skeleton: null },
  ],
  motions: {},
};

const bad = <T>(value: unknown): T => value as T;

const reasonOf = (output: { reason: string | null }): string =>
  output.reason ?? "";

/**
 * The geometry queries address the same placements the perform gate does, and
 * say the truth when they cannot.
 *
 * Two faults met here. `getReach` and `measureDistance` built their placement
 * lookup from `scene.nodes` alone, so the camera ids #1294 made a legal
 * positional target everywhere else could not be measured at all, while the
 * guide corpus teaches both "face the camera" and "measure before you stage".
 * And every resolution failure, a camera id, an unplaced id, an unresolvable
 * group, collapsed into one sentence claiming the target "is not positional",
 * which is the exact defect #1294 fixed inside `performShot`: blaming the
 * discriminator of a kind the same sentence lists as legal leaves the
 * correction round nothing it can act on.
 *
 * Every expected distance is the Euclidean formula on the stated coordinates.
 *
 * Scenarios:
 *
 * 1. `measureDistance` resolves a camera id on either side: lens `(0, 1.5, 5)` to
 *    marker `(4, 0, 2)` is `hypot(4, 1.5, 3)`, and the reported endpoints are
 *    the two placements themselves.
 * 2. `getReach` resolves a camera target too, reporting `reason: null` and the
 *    lens as the measured target point.
 * 3. An unplaced `node` id now names that id and says it is not placed, and the
 *    sentence no longer claims a node target is non-positional.
 * 4. A `group` whose members are all unplaced names every member; a malformed
 *    group (a `nodes` that is not a list) says it names none.
 * 5. The relative kinds keep the sentence that was always true of them, and an
 *    unknown or malformed target is refused by its kind: the honest cases must
 *    not have been traded away for the dishonest ones.
 * 6. Both sides unresolved for DIFFERENT causes yield one clause each, so a `from`
 *    that named an unplaced id and a `to` that was a heading stop reading as
 *    one problem. The identically-faulted pair (both sides relative), where the
 *    risk is collapsing two clauses into one rather than merging two causes,
 *    belongs to `test_mcp_geometry_query_edges`.
 * 7. The shape floor the camera read requires, at all three rungs: a `cameras`
 *    that is not a list, an ENTRY that is not an object, and an entry whose own
 *    fields are malformed each refuse with a located violation instead of
 *    throwing a `TypeError` out of the placement table.
 */
export const test_mcp_geometry_camera_target = (): void => {
  // 1. a camera is a measurable placement.
  const measured = app.measureDistance({
    scene,
    from: { kind: "node", node: "camera" },
    to: { kind: "node", node: "marker" },
  });
  TestValidator.predicate(
    "a camera id measures against a node id",
    measured.reason === null &&
      measured.measurement !== null &&
      vclose(measured.measurement.from, LENS) &&
      vclose(measured.measurement.to, MARKER) &&
      nclose(measured.measurement.distance, Math.hypot(4, 1.5, 3)),
  );

  // 2. and a reachable one.
  const reach = app.getReach({
    context,
    actor: "actor",
    target: { kind: "node", node: "camera" },
  });
  TestValidator.predicate(
    "a camera id is a reach target",
    reach.reason === null &&
      reach.reach !== null &&
      vclose(reach.reach.target, LENS),
  );

  // 3. an unplaced node id is named, not miscategorised.
  const ghost = app.measureDistance({
    scene,
    from: { kind: "node", node: "ghost" },
    to: { kind: "node", node: "marker" },
  });
  TestValidator.predicate(
    "an unplaced node id is named and is not called non-positional",
    ghost.measurement === null &&
      reasonOf(ghost).includes('"ghost"') &&
      reasonOf(ghost).includes("is not placed in the staged scene") &&
      !reasonOf(ghost).includes("not positional"),
  );

  // 4. groups: every unplaced member, and the malformed list.
  const group = app.getReach({
    context,
    actor: "actor",
    target: { kind: "group", nodes: ["ghost-a", "ghost-b"] },
  });
  TestValidator.predicate(
    "an all-unplaced group names every member",
    group.reach === null &&
      reasonOf(group).includes('"ghost-a"') &&
      reasonOf(group).includes('"ghost-b"'),
  );
  TestValidator.predicate(
    "a group carrying no member list says it names none",
    reasonOf(
      app.getReach({
        context,
        actor: "actor",
        target: bad({ kind: "group", nodes: null }),
      }),
    ).includes("its group names no members"),
  );

  // 5. the honest cases stay honest.
  TestValidator.predicate(
    "a relative target is still refused as relative",
    reasonOf(
      app.getReach({
        context,
        actor: "actor",
        target: { kind: "direction", headingDeg: 90 } as never,
      }),
    ).includes('a target of kind "direction" is relative'),
  );
  TestValidator.predicate(
    "an unknown kind is refused by that kind",
    reasonOf(
      app.measureDistance({
        scene,
        from: bad({ kind: "elsewhere" }),
        to: { kind: "node", node: "marker" },
      }),
    ).includes('"elsewhere" is not a positional target kind'),
  );
  TestValidator.predicate(
    "a target that is not an object at all is refused as malformed",
    reasonOf(
      app.measureDistance({
        scene,
        from: bad("nonsense"),
        to: { kind: "node", node: "marker" },
      }),
    ).includes('"malformed" is not a positional target kind'),
  );

  // 6. one clause per unresolved side.
  const both = app.measureDistance({
    scene,
    from: { kind: "node", node: "ghost" },
    to: { kind: "offscreen", edge: "left" } as never,
  });
  TestValidator.predicate(
    "each unresolved side states its own fault",
    reasonOf(both).includes("the from target must resolve to a point") &&
      reasonOf(both).includes("the to target must resolve to a point") &&
      reasonOf(both).includes('"ghost"') &&
      reasonOf(both).includes('a target of kind "offscreen" is relative'),
  );

  // 7. the shape floor the camera read requires.
  TestValidator.predicate(
    "a scene whose cameras are not a list refuses with a located violation",
    throwsError(
      () =>
        app.measureDistance({
          scene: bad({ ...scene, cameras: null }),
          from: { kind: "node", node: "marker" },
          to: { kind: "node", node: "actor" },
        }),
      ["$input.scene.cameras", "must be an array"],
    ) &&
      throwsError(
        () =>
          app.getReach({
            context: bad({
              ...context,
              scene: { ...scene, cameras: [{ id: "", transform: null }] },
            }),
            actor: "actor",
            target: { kind: "node", node: "marker" },
          }),
        ["$input.context.scene.cameras[0]"],
      ) &&
      // The ENTRY gate, not a field gate: `nodePositions` reads
      // `camera.transform.translation` off each element, so a camera entry that
      // is not an object must stop at its own index. Without this rung the read
      // is a TypeError with no path, which is the failure the shape gates exist
      // to replace (#1005/#1007).
      throwsError(
        () =>
          app.measureDistance({
            scene: bad({ ...scene, cameras: [null] }),
            from: { kind: "node", node: "marker" },
            to: { kind: "node", node: "actor" },
          }),
        ["$input.scene.cameras[0]", "must be a JSON object"],
      ),
  );
};
