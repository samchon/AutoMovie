import {
  Matrix4,
  composeScene,
  motionToClip,
  resolveFrame,
  resolvePose,
  sceneToNodes,
} from "@automovie/engine";
import {
  IAutoMovieModel,
  IAutoMovieScene,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  createModel,
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

const T = (
  x: number,
  y: number,
  z: number,
  rotY?: { y: number; w: number },
): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation:
    rotY === undefined
      ? { x: 0, y: 0, z: 0, w: 1 }
      : { x: 0, y: rotY.y, z: 0, w: rotY.w },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * `sceneToNodes` lowers the specialized scene onto the general node graph as
 * REST STRUCTURE (placements as world-transformed groups, cameras/lights as
 * payload nodes, skeleton subtrees prefixed per placement), and what a node is
 * DOING arrives as clip overrides. The static parity contract (proof A of #594
 * S3): every lowered element's `composeScene` world equals the specialized
 * path's expectation: a placement/camera/light world IS its transform, a
 * held-pose actor's bone worlds are `placement ∘ resolvePose(pose)` (pose.root
 * folded by resolvePose, the same `foldRoot` semantics beatEndSim uses), and
 * the actor's synthetic root sits at `placement ∘ pose.root`.
 *
 * Scenarios:
 *
 * 1. A placement group's world transform equals its scene-node transform, a camera
 *    node's world equals the camera transform, a light node's world equals the
 *    light transform (rest structure, no overrides).
 * 2. A skeleton-less prop placement lowers no subtree: its group node is the only
 *    node carrying its id prefix.
 * 3. A held pose played as a constant clip (bridged with the placement's
 *    `nodePrefix`) reproduces the specialized path on every bone: world ≡
 *    `placement ∘ resolvePose(pose)` (position and rotation).
 * 4. The actor's synthetic root node world equals `placement ∘ pose.root` (the
 *    fold contract), not the placement alone: the negative twin distinguishes
 *    the two whenever `pose.root` is non-identity.
 */
export const test_resolve_scene_to_nodes = (): void => {
  const skeleton = createSkeleton();
  const actorModel: IAutoMovieModel = { ...createModel(skeleton), id: "hero" };
  const propModel: IAutoMovieModel = { ...createModel(null), id: "crate" };
  const scene: IAutoMovieScene = {
    id: "scene-1",
    name: null,
    nodes: [
      {
        id: "actor",
        model: "hero",
        // 90° about +Y at (1, 0, 2).
        transform: T(1, 0, 2, { y: Math.SQRT1_2, w: Math.SQRT1_2 }),
        motion: null,
        pose: null,
      },
      {
        id: "box",
        model: "crate",
        transform: T(-3, 0.5, 0),
        motion: null,
        pose: null,
      },
    ],
    cameras: [
      { id: "cam", transform: T(0, 1.5, 4), fovY: 40, near: 0.1, far: 100 },
    ],
    lights: [
      {
        id: "sun",
        type: "directional",
        transform: T(0, 5, 0),
        color: { r: 1, g: 1, b: 1, a: null, hex: null },
        intensity: 1,
      },
    ],
  };
  const models = { hero: actorModel, crate: propModel };
  const nodes = sceneToNodes({ scene, models });

  // 1. rest structure worlds ≡ declared transforms
  const rest = composeScene(nodes);
  const placement = scene.nodes[0]!.transform;
  const placementMatrix = Matrix4.compose(
    placement.translation,
    placement.rotation,
    placement.scale,
  );
  TestValidator.predicate(
    "placement group world equals its scene transform",
    vclose(Matrix4.position(rest.get("actor")!), placement.translation) &&
      qclose(
        Matrix4.decompose(rest.get("actor")!).rotation,
        placement.rotation,
      ),
  );
  TestValidator.predicate(
    "camera node world equals the camera transform",
    vclose(Matrix4.position(rest.get("cam")!), { x: 0, y: 1.5, z: 4 }),
  );
  TestValidator.predicate(
    "light node world equals the light transform",
    vclose(Matrix4.position(rest.get("sun")!), { x: 0, y: 5, z: 0 }),
  );

  // 2. the prop lowers no subtree
  TestValidator.equals(
    "skeleton-less prop lowers only its group node",
    nodes.filter((node) => node.id.startsWith("box")).length,
    1,
  );
  TestValidator.predicate(
    "the actor lowers its bone subtree under the placement",
    nodes.some((node) => node.id === "actor/hips") &&
      nodes.some((node) => node.id === "actor/root"),
  );

  // 3.-4. held pose through the clip path ≡ placement ∘ resolvePose(pose)
  const pose = makePose(
    [
      joint("leftUpperArm", { flexion: 30, abduction: 45 }),
      joint("leftLowerArm", { flexion: 90 }),
    ],
    T(0.5, 0, 0, { y: Math.SQRT1_2, w: Math.SQRT1_2 }),
  );
  const held = makeMotion([keyframe(0, pose), keyframe(1, pose)], 1);
  const bridge = motionToClip({
    motion: held,
    skeleton,
    nodePrefix: "actor/",
  });
  const world = resolveFrame({
    nodes,
    clip: bridge.clip,
    limits: [],
    seconds: 0.5,
  }).world;
  const expected = resolvePose(pose, skeleton);
  let bonesMatch = true;
  for (const bone of expected) {
    const matrix = world.get(`actor/${bone.bone}`);
    if (matrix === undefined) {
      bonesMatch = false;
      break;
    }
    const specialized = Matrix4.multiply(
      placementMatrix,
      Matrix4.compose(bone.worldPosition, bone.worldRotation, {
        x: 1,
        y: 1,
        z: 1,
      }),
    );
    if (
      !vclose(Matrix4.position(matrix), Matrix4.position(specialized)) ||
      !qclose(
        Matrix4.decompose(matrix).rotation,
        Matrix4.decompose(specialized).rotation,
      )
    ) {
      bonesMatch = false;
      break;
    }
  }
  TestValidator.predicate(
    "held pose through the clip path equals placement ∘ resolvePose",
    bonesMatch,
  );

  const rootWorld = world.get("actor/root")!;
  const folded = Matrix4.multiply(
    placementMatrix,
    Matrix4.compose(
      pose.root!.translation,
      pose.root!.rotation,
      pose.root!.scale,
    ),
  );
  TestValidator.predicate(
    "the synthetic root sits at placement ∘ pose.root",
    vclose(Matrix4.position(rootWorld), Matrix4.position(folded)),
  );
  TestValidator.predicate(
    "…which differs from the bare placement (the fold is real)",
    !vclose(Matrix4.position(rootWorld), placement.translation),
  );
};
