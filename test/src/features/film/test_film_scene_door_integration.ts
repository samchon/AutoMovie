import {
  Matrix4,
  forgeProp,
  resolveFrame,
  sceneToNodes,
} from "@automovie/engine";
import { IAutoMovieClip, IAutoMovieScene } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";
import { createDoorPropSpec } from "./test_film_forge_prop";

/** Quat values for a rotation of `deg` about +Y. */
const yQuat = (deg: number): number[] => {
  const half = (deg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

const swing = (deg: number): IAutoMovieClip => ({
  id: "swing",
  name: null,
  duration: 1,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "frontDoor/hinge", path: "rotation" },
      times: [0],
      values: yQuat(deg),
      interpolation: "linear",
    },
  ],
});

const basisX = (m: number[]): [number, number, number] => [m[0]!, m[1]!, m[2]!];

const SCENE: IAutoMovieScene = {
  id: "hall",
  name: null,
  nodes: [
    {
      id: "frontDoor",
      model: "door",
      transform: {
        translation: { x: 5, y: 0, z: 2 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      motion: null,
      pose: null,
    },
    {
      id: "knight",
      model: "hero",
      transform: {
        translation: { x: -2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

/**
 * The #603×S3 integration made whole: a door FORGED by forgeProp is PLACED in a
 * scene, its articulation lowers into the one scene graph, and its
 * author-declared constraint executes with the placement composed in: the
 * S4/#642 door oracles now hold THROUGH the scene, alongside a second occupant
 * whose skeleton shares the graph without collision.
 *
 * Scenarios:
 *
 * 1. The forged door forges, lowers under its placement, and an in-range 90° swing
 *    passes: the hinge's world POSITION is `placement + (0,1,0)` (the
 *    placement composition is real), and its world X basis lands at
 *    `(0,0,-1)`.
 * 2. The declared copy driver mirrors the hinge in the same scene graph.
 * 3. An over-limit 150° swing clamps to exactly 110° (world X basis `(cos110°, 0,
 *    −sin110°)`) with every violation tagged by the forged profile on the
 *    PREFIXED hinge channel.
 * 4. The second occupant's bones live in the same graph (`knight/hips` resolves):
 *    no id collisions between actor and prop subtrees.
 */
export const test_film_scene_door_integration = (): void => {
  const base = createDoorPropSpec();
  // A distinctive hinge translation so the placement-composition oracle is
  // provable: hinge world position must be placement + (0, 1, 0).
  const forged = forgeProp({
    ...base,
    articulation: {
      ...base.articulation!,
      nodes: base.articulation!.nodes.map((node) =>
        node.id === "hinge"
          ? {
              ...node,
              transform: {
                ...node.transform,
                translation: { x: 0, y: 1, z: 0 },
              },
            }
          : node,
      ),
    },
  });
  TestValidator.equals("the door forges", forged.success, true);
  if (forged.success !== true) return;
  const articulation = forged.prop.articulation!;

  const nodes = sceneToNodes({
    scene: SCENE,
    props: { door: forged.prop },
    models: { hero: { ...createModel(), id: "hero" } },
  });
  const profiles = [
    {
      profile: articulation.profile,
      binding: articulation.binding,
      nodePrefix: "frontDoor/",
    },
  ];

  const open = resolveFrame({
    nodes,
    clip: swing(90),
    limits: [],
    profiles,
    seconds: 0,
  });
  TestValidator.equals("90° swing passes in-scene", open.violations.length, 0);
  const hinge = open.world.get("frontDoor/hinge")!;
  TestValidator.predicate(
    "hinge world position composes the placement",
    vclose(Matrix4.position(hinge), { x: 5, y: 1, z: 2 }),
  );
  const openX = basisX(hinge);
  TestValidator.predicate(
    "hinge world rotated 90° through the scene",
    nclose(openX[0], 0) && nclose(openX[1], 0) && nclose(openX[2], -1),
  );
  const mirrorX = basisX(open.world.get("frontDoor/handleMirror")!);
  TestValidator.predicate(
    "the declared driver mirrors the hinge in-scene",
    nclose(mirrorX[0], 0) && nclose(mirrorX[2], -1),
  );

  const slammed = resolveFrame({
    nodes,
    clip: swing(150),
    limits: [],
    profiles,
    seconds: 0,
  });
  TestValidator.predicate(
    "over-swing violations tagged by the forged profile on the prefixed channel",
    slammed.violations.length > 0 &&
      slammed.violations.every(
        (violation) =>
          violation.profile === "door-profile" &&
          violation.channel === "node:frontDoor/hinge:rotation",
      ),
  );
  const cos110 = Math.cos((110 * Math.PI) / 180);
  const sin110 = Math.sin((110 * Math.PI) / 180);
  const slammedX = basisX(slammed.world.get("frontDoor/hinge")!);
  TestValidator.predicate(
    "over-swing clamps to exactly 110° through the scene",
    nclose(slammedX[0], cos110) &&
      nclose(slammedX[1], 0) &&
      nclose(slammedX[2], -sin110),
  );

  TestValidator.predicate(
    "the second occupant shares the graph without collision",
    open.world.has("knight/hips"),
  );
};
