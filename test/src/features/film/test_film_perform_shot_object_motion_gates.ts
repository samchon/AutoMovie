import { IAutoMovieClip } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createDoorPropSpec as doorSpec } from "./test_film_forge_prop";
import {
  HINGE,
  IDoorShotProps,
  compileDoorShot,
  swingClip,
} from "./test_film_perform_shot_object_motions";

/** Every diagnostic fact of a compile, or `"compiled"` when it succeeded. */
const refusal = (props: IDoorShotProps): string => {
  const compiled = compileDoorShot(props);
  return compiled.success === true
    ? "compiled"
    : compiled.diagnostics
        .map((diagnostic) => `${diagnostic.path} ${diagnostic.fact}`)
        .join(" | ");
};

/** True when the compile was refused with a fact naming each fragment. */
const refusedWith = (
  clips: readonly IAutoMovieClip[],
  ...fragments: readonly string[]
): boolean => {
  const facts = refusal({ objectMotions: clips });
  return (
    facts !== "compiled" &&
    fragments.every((fragment) => facts.includes(fragment))
  );
};

/**
 * What a shot may NOT turn, and why each refusal is a defect caught rather than
 * a preference enforced.
 *
 * The channel exists so a door can swing. Every one of these would produce a
 * compiled shot that reads as if something moves and either moves nothing,
 * moves two things against each other, or moves one thing past a limit its own
 * record declares — the class of false green this pipeline refuses everywhere
 * else.
 *
 * Scenarios:
 *
 * 1. A node no shot staged, and a joint no staged prop declares, are both refused:
 *    a clip addressing nothing renders as silence.
 * 2. A node this shot's performance drives is refused; a performer moves off its
 *    rig, and a transform clip over it would fight the pose every frame.
 * 3. A swing past the travel the prop's own profile declares is refused, naming
 *    the profile and the channel rather than an anonymous bound; the adjacent
 *    swing one degree inside the same bound compiles.
 * 4. A key outside the shot's own clock is refused: a turn no frame reads.
 * 5. `cubicspline` is refused, because a spline's tangents can leave a declared
 *    travel between two keys the gate proved, and nothing clamps an object clip
 *    downstream.
 * 6. Two authored clips sharing one id are refused; `validateUniqueIds` would
 *    otherwise refuse the whole shot artifact with no authoring path to name.
 * 7. A pointer track is still refused on this field, because the transform-clip
 *    rule stands under the narrower one this field adds.
 * 8. A channel a baked clip already drives is refused, and it is refused per
 *    CHANNEL: the torch's baked follow owns its rotation, so a second rotation
 *    is two authorities the sampler would resolve by producer order.
 * 9. An id a baked clip already carries is refused here, where an authoring path
 *    can be named, rather than by the artifact gate that would throw.
 * 10. A prop joint whose lowered id collides with a staged scene node is named as
 *     the collision it is; composing that graph throws instead of reporting, so
 *     a shot carrying one may not be resolved at all.
 * 11. A shot that registers no prop still drives its staged set pieces, and a joint
 *     of the prop it no longer carries is refused: the registry is what lowers
 *     a joint, so dropping it drops the address.
 * 12. A prop the forge refuses lowers no joint either, and a node id declared twice
 *     keeps the first registration; both are the placement gate's faults to
 *     report, not this one's to report twice.
 * 13. A node path the pipeline never writes is refused by the transform-clip rule
 *     and compared against nothing, since an address with no canonical key
 *     cannot collide with one.
 */
export const test_film_perform_shot_object_motion_gates = (): void => {
  TestValidator.predicate(
    "a node this shot never staged is refused",
    refusedWith(
      [swingClip("ghost", "sideGate", 20)],
      "neither a staged scene node nor a lowered prop articulation joint",
    ),
  );
  TestValidator.predicate(
    "a joint the staged prop does not declare is refused",
    refusedWith(
      [swingClip("ghost", "frontDoor/latch", 20)],
      "neither a staged scene node nor a lowered prop articulation joint",
    ),
  );

  TestValidator.predicate(
    "a performing actor's node is refused",
    refusedWith(
      [swingClip("shove", "knightA", 20)],
      "is driven by this shot's performance",
    ),
  );

  TestValidator.predicate(
    "a swing past the declared travel is refused, naming the profile",
    refusedWith(
      [swingClip("slam", HINGE, 150)],
      `drives "node:${HINGE}:rotation"`,
      'profile "door-profile"',
    ),
  );
  TestValidator.equals(
    "the adjacent swing one degree inside the same travel compiles",
    refusal({ objectMotions: [swingClip("open", HINGE, 109)] }),
    "compiled",
  );

  TestValidator.predicate(
    "a key past the shot's own clock is refused",
    refusedWith(
      [swingClip("late", HINGE, 20, { times: [9] })],
      "must land inside the shot's own clock of 0..2s",
    ),
  );

  TestValidator.predicate(
    "a spline track is refused",
    refusedWith(
      [
        swingClip("eased", HINGE, 20, {
          interpolation: "cubicspline",
          times: [0],
          values: [...new Array(12).fill(0)],
        }),
      ],
      "interpolates step or linear",
    ),
  );

  TestValidator.predicate(
    "two authored clips sharing one id are refused",
    refusedWith(
      [swingClip("swing", HINGE, 20), swingClip("swing", "hall/panel", 20)],
      "duplicates $input.objectMotions[0].id",
    ),
  );

  TestValidator.predicate(
    "a pointer track is still refused on this field",
    refusedWith(
      [
        {
          id: "dim",
          name: null,
          duration: 2,
          loop: false,
          tracks: [
            {
              channel: {
                kind: "pointer",
                pointer: "/lights/sun/intensity",
                valueType: "scalar",
              },
              times: [0],
              values: [0.5],
              interpolation: "linear",
            },
          ],
        },
      ],
      'channel kind must be "node"',
    ),
  );

  TestValidator.predicate(
    "a channel a baked follow already drives is refused",
    refusedWith(
      [swingClip("spin", "torch", 20)],
      'object motion channel "node:torch:rotation" is already driven',
    ),
  );
  TestValidator.equals(
    "the same node's untouched channel is not refused with it",
    refusal({
      objectMotions: [
        {
          ...swingClip("lift", "torch", 0),
          tracks: [
            {
              channel: { kind: "node", node: "torch", path: "scale" },
              times: [0],
              values: [2, 2, 2],
              interpolation: "linear",
            },
          ],
        },
      ],
    }),
    "compiled",
  );

  TestValidator.predicate(
    "an id a baked clip already carries is refused",
    refusedWith(
      [swingClip("attach:torch", HINGE, 20)],
      "collides with a clip this shot baked",
    ),
  );

  TestValidator.predicate(
    "a joint whose lowered id collides with a staged node is named",
    refusal({
      objectMotions: [swingClip("swing", HINGE, 20)],
      extraSet: [
        { node: HINGE, model: "slab", position: { x: 5, y: 0, z: 0 } },
      ],
    }).includes(`the lowered scene carries ${HINGE} twice`),
  );

  TestValidator.equals(
    "a shot registering no prop still turns its staged pieces",
    refusal({
      objectMotions: [swingClip("panel-swing", "hall/panel", 30)],
      props: undefined,
    }),
    "compiled",
  );
  TestValidator.predicate(
    "and the joint of the prop it no longer carries is refused",
    refusal({
      objectMotions: [swingClip("swing", HINGE, 20)],
      props: undefined,
    }).includes(
      "neither a staged scene node nor a lowered prop articulation joint",
    ),
  );

  TestValidator.predicate(
    "a prop the forge refuses lowers no joint",
    refusal({
      objectMotions: [swingClip("swing", HINGE, 20)],
      // A prop whose model id no longer equals its node breaks the staging
      // join `forgeProp` gates, so nothing of it reaches the scene graph.
      props: [{ ...doorSpec(), model: { ...doorSpec().model, id: "other" } }],
    }).includes(
      "neither a staged scene node nor a lowered prop articulation joint",
    ),
  );
  TestValidator.equals(
    "a node registered twice keeps its first registration",
    refusal({
      objectMotions: [swingClip("swing", HINGE, 109)],
      props: [
        doorSpec(),
        // Second registration of the same node, with a travel wide enough to
        // admit the swing the first one refuses. The first wins, so this
        // compiles exactly as the single registration does.
        doorSpec(),
      ],
    }),
    "compiled",
  );

  TestValidator.predicate(
    "a node path the pipeline never writes is refused",
    refusedWith(
      [
        {
          ...swingClip("fade", HINGE, 0),
          tracks: [
            {
              channel: {
                kind: "node",
                node: HINGE,
                path: "opacity",
              } as unknown as IAutoMovieClip["tracks"][number]["channel"],
              times: [0],
              values: [0.5],
              interpolation: "linear",
            },
          ],
        },
      ],
      "clip track channel path must be one of",
    ),
  );
};
