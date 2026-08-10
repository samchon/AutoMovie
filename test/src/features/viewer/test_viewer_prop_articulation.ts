import {
  compareCodeUnits,
  placementChildNode,
  sceneToNodes,
} from "@automovie/engine";
import {
  IAutoMovieNode,
  IAutoMoviePropSpec,
  IAutoMovieScene,
} from "@automovie/interface";
import {
  applyObjectMotions,
  buildModel,
  buildPropArticulation,
  buildScene,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, throwsError, vclose } from "../internal/predicates";

const IDENTITY = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** One articulation joint, optionally driving one part of the prop's model. */
const joint = (
  id: string,
  parent: string | null,
  mesh: string | null,
  x = 0,
): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform: { ...IDENTITY, translation: { x, y: 0, z: 0 } },
  mesh,
  camera: null,
  light: null,
  skin: null,
});

/** A two-box gate: a post that never moves, a leaf hung on one hinge. */
const gateSpec = (
  nodes: IAutoMovieNode[] = [
    joint("hinge", null, "leaf", -0.5),
    joint("cap", "hinge", null),
  ],
): IAutoMoviePropSpec => ({
  node: "gate",
  model: {
    id: "gate",
    name: null,
    origin: "generated",
    skeleton: null,
    affordances: [],
    materials: [],
    parts: [
      {
        id: "post",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 0.1, height: 2, depth: 0.1 },
        },
        material: null,
        attachedBone: null,
        transform: { ...IDENTITY, translation: { x: -0.6, y: 1, z: 0 } },
      },
      {
        id: "leaf",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 1, height: 2, depth: 0.05 },
        },
        material: null,
        attachedBone: null,
        // Model-local, like every part: the leaf fills the opening the prop
        // stands in, and the hinge it hangs on is half a width to its left.
        transform: { ...IDENTITY, translation: { x: 0, y: 1, z: 0 } },
      },
    ],
    asset: null,
    body: null,
  },
  articulation: {
    nodes,
    profile: {
      id: "gate-hinge",
      name: "hinge",
      controls: [],
      drivers: [] as [],
      limits: [],
    },
    binding: {
      profile: "gate-hinge",
      root: "hinge",
      instanceName: null,
      boneMap: {},
    },
  },
});

/** The staged scene the gate stands in, at `x` metres along +X. */
const sceneOf = (x = 2): IAutoMovieScene => ({
  id: "hall",
  name: null,
  nodes: [
    {
      id: "frontGate",
      model: "gate",
      transform: { ...IDENTITY, translation: { x, y: 0, z: 0 } },
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
});

/** Build the scene, then its prop articulation, and hand both back. */
const build = (
  spec: IAutoMoviePropSpec,
  scene: IAutoMovieScene = sceneOf(),
): {
  root: THREE.Scene;
  articulation: ReturnType<typeof buildPropArticulation>;
} => {
  const model = buildModel(spec.model);
  const root = buildScene(scene, () => model).scene;
  return {
    root,
    articulation: buildPropArticulation({
      scene,
      props: [spec],
      nodeObjects: new Map(
        scene.nodes.map((node) => [node.id, root.getObjectByName(node.id)!]),
      ),
      modelObjects: new Map(scene.nodes.map((node) => [node.id, model])),
    }),
  };
};

/** World position of the named object, as a plain vector. */
const worldOf = (root: THREE.Object3D, name: string): THREE.Vector3 => {
  root.updateMatrixWorld(true);
  return root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
};

/**
 * A prop's declared joints become objects, and the part each one names rides
 * it.
 *
 * The engine gates a prop's articulation, lowers it under the placement, and
 * bounds the clip that drives it; the viewer built one object per scene node
 * and nothing under it, so a hinge with a validated, ROM-checked swing rendered
 * a door standing still. Two facts have to hold for that to stop being true:
 * the object a clip channel names must exist under the placement it belongs to,
 * and the part the joint claims must hang off it rather than off the model
 * root.
 *
 * Scenarios:
 *
 * 1. The joints the viewer builds are named exactly what `sceneToNodes` lowers
 *    them as, so the artifact a shot was gated against and the objects a frame
 *    is drawn from agree by construction rather than by two spellings.
 * 2. The claimed leaf leaves the model root and hangs under the hinge; the post it
 *    did not claim stays where the model put it. Placement composes: the hinge
 *    stands at the placement plus its own local offset.
 * 3. Turning the hinge 90° about +Y through `applyObjectMotions` carries the leaf
 *    around the pivot, which is the whole claim: the hinge's own world position
 *    is unchanged and the leaf's is not.
 * 4. `restore` puts every joint back at the transform its prop declares, so a host
 *    seeking backwards past a clip's first key does not keep the last frame's
 *    turn.
 * 5. A joint that names a part the model does not carry, a placement the host
 *    built no group for, and one it built no model for all throw rather than
 *    rendering a leaf frozen at the model origin, and so does a joint whose
 *    declared parent the prop never declares.
 * 6. Nothing is built for a placement no prop claims, for a rigid prop, or for a
 *    second registration of a node already registered: the first wins, exactly
 *    as the engine's own gate resolves it.
 */
export const test_viewer_prop_articulation = (): void => {
  const spec = gateSpec();
  const scene = sceneOf();
  const { root, articulation } = build(spec, scene);
  const hinge = placementChildNode("frontGate", "hinge");
  TestValidator.equals(
    "the viewer names its joints what the engine lowers them as",
    [...articulation.joints.keys()].sort(compareCodeUnits),
    sceneToNodes({ scene, props: { gate: spec } })
      .map((node) => node.id)
      .filter((id) => id !== "frontGate")
      .sort(compareCodeUnits),
  );

  TestValidator.equals(
    "the claimed part rides the joint and the unclaimed one does not",
    {
      leaf: root.getObjectByName("leaf")!.parent!.name,
      post: root.getObjectByName("post")!.parent!.name,
    },
    { leaf: hinge, post: spec.model.name ?? spec.model.id },
  );
  TestValidator.equals(
    "the hinge sits at the placement plus its offset, and the leaf has not moved",
    namedFacts([
      [
        "hingePlaced",
        () => vclose(worldOf(root, hinge), { x: 1.5, y: 0, z: 0 }),
      ],
      ["leafHeld", () => vclose(worldOf(root, "leaf"), { x: 2, y: 1, z: 0 })],
    ]),
    { hingePlaced: true, leafHeld: true },
  );

  const before = worldOf(root, "leaf");
  applyObjectMotions(
    [
      {
        id: "swing",
        name: null,
        duration: 1,
        loop: false,
        tracks: [
          {
            channel: { kind: "node", node: hinge, path: "rotation" },
            times: [0],
            // 90° about +Y.
            values: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
            interpolation: "linear",
          },
        ],
      },
    ],
    0,
    (node) => articulation.joints.get(node),
  );
  const after = worldOf(root, "leaf");
  TestValidator.equals(
    "the turn carries the leaf around the pivot and leaves the pivot alone",
    namedFacts([
      ["hingeHeld", () => vclose(worldOf(root, hinge), { x: 1.5, y: 0, z: 0 })],
      // The leaf sat half a width along +X of the hinge; a quarter turn about
      // +Y puts it half a width along −Z of it, at the same height.
      ["leafSwung", () => vclose(after, { x: 1.5, y: 1, z: -0.5 })],
      ["leafMoved", () => before.distanceTo(after) > 0.5],
    ]),
    { hingeHeld: true, leafSwung: true, leafMoved: true },
  );

  articulation.restore();
  TestValidator.predicate(
    "restore returns the leaf to the placement its prop declares",
    vclose(worldOf(root, "leaf"), { x: 2, y: 1, z: 0 }),
  );

  TestValidator.predicate(
    "a joint naming a part the model does not carry throws",
    throwsError(
      () => build(gateSpec([joint("hinge", null, "sash")])),
      'drives part "sash"',
    ),
  );
  TestValidator.equals(
    "a placement missing either half of its build throws",
    namedFacts([
      [
        "noGroup",
        () =>
          throwsError(
            () =>
              buildPropArticulation({
                scene,
                props: [spec],
                nodeObjects: new Map(),
                modelObjects: new Map([["frontGate", buildModel(spec.model)]]),
              }),
            "which the host built no object for",
          ),
      ],
      [
        "noModel",
        () =>
          throwsError(
            () =>
              buildPropArticulation({
                scene,
                props: [spec],
                nodeObjects: new Map([["frontGate", new THREE.Group()]]),
                modelObjects: new Map(),
              }),
            "which the host built no object for",
          ),
      ],
    ]),
    { noGroup: true, noModel: true },
  );
  TestValidator.predicate(
    "a joint whose declared parent the prop does not carry throws",
    throwsError(
      () => build(gateSpec([joint("cap", "ghost", null)])),
      'declares parent "ghost"',
    ),
  );

  const rigid: IAutoMoviePropSpec = { ...gateSpec(), articulation: null };
  TestValidator.equals(
    "nothing is built for an unclaimed placement, a rigid prop, or a repeat",
    {
      unclaimed: buildPropArticulation({
        scene,
        props: [],
        nodeObjects: new Map(),
        modelObjects: new Map(),
      }).joints.size,
      rigid: build(rigid).articulation.joints.size,
      repeated: buildPropArticulation({
        scene,
        props: [rigid, spec],
        nodeObjects: new Map(),
        modelObjects: new Map(),
      }).joints.size,
    },
    { unclaimed: 0, rigid: 0, repeated: 0 },
  );
};
