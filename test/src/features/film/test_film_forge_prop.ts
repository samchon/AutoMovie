import { forgeProp } from "@automovie/engine";
import {
  IAutoMovieNode,
  IAutoMoviePropSpec,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const IDENTITY: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const jointNode = (
  id: string,
  parent: string | null = null,
): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "group",
  transform: IDENTITY,
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const SIN55 = Math.sin((55 * Math.PI) / 180);
const COS55 = Math.cos((55 * Math.PI) / 180);

/** A fully-loaded door prop: body + stack-top affordance + hinge articulation. */
export const createDoorPropSpec = (): IAutoMoviePropSpec => ({
  node: "door",
  model: {
    id: "door",
    name: "door",
    origin: "generated",
    skeleton: null,
    body: { mass: 25, centerOfMass: null, friction: 0.4, restitution: 0.1 },
    affordances: [
      {
        id: "top",
        kind: "stack-top",
        frame: { ...IDENTITY, translation: { x: 0, y: 2, z: 0 } },
        extent: [
          { x: -0.4, y: 0, z: -0.02 },
          { x: 0.4, y: 0, z: -0.02 },
          { x: 0.4, y: 0, z: 0.02 },
          { x: -0.4, y: 0, z: 0.02 },
        ],
      },
    ],
    materials: [],
    parts: [
      {
        id: "panel",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 0.8, height: 2, depth: 0.04 },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
    asset: null,
  },
  articulation: {
    nodes: [
      jointNode("root"),
      jointNode("hinge", "root"),
      jointNode("handleMirror", "root"),
    ],
    profile: {
      id: "door-profile",
      name: "hinge",
      controls: [],
      drivers: [
        {
          type: "copy",
          owner: "mirror",
          source: "pivot",
          translation: false,
          rotation: true,
          scale: false,
          influence: 1,
        },
      ],
      limits: [
        {
          channel: { kind: "node", node: "pivot", path: "rotation" },
          min: [0, 0, 0, COS55],
          max: [0, SIN55, 0, 1],
        },
      ],
    },
    binding: {
      profile: "door-profile",
      root: "root",
      instanceName: null,
      boneMap: { pivot: "hinge", mirror: "handleMirror" },
    },
  },
});

/**
 * ForgeProp accepts a prop authored entirely as data (crude primitive parts
 * carrying a physical body, a stack-top affordance, and a self-declared hinge
 * articulation) when both the model contract and the articulation
 * contract hold.
 *
 * Scenarios:
 *
 * 1. The fully-loaded door prop passes and the accepted spec is echoed for the
 *    staging join.
 * 2. A rigid prop (articulation null) passes on the model contract alone: the
 *    articulation gates never fire for it.
 */
export const test_film_forge_prop = (): void => {
  const spec = createDoorPropSpec();
  const forged = forgeProp(spec);
  TestValidator.equals("articulated prop passes", forged.success, true);
  TestValidator.equals(
    "accepted spec echoed",
    forged.success === true ? forged.prop.node : null,
    "door",
  );

  const rigid = forgeProp({ ...spec, articulation: null });
  TestValidator.equals("rigid prop passes", rigid.success, true);
};
