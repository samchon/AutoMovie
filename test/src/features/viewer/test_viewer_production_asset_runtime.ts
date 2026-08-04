import {
  IAutoMovieExpression,
  IAutoMovieModel,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import {
  AutoMoviePlayer,
  IAutoMovieViewerSnapshotRenderer,
  applyExpression,
  buildModel,
  captureViewerSnapshot,
  createImportedModelObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
  keyframe,
  makeMotion,
} from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The viewer production-asset runtime contract: skinned mesh parts bind to the
 * model skeleton, rigid attachments keep precedence over a stray skin payload,
 * imported three/VRM-like objects accept pose/expression playback through the
 * same player frame, and the public snapshot helper renders before reading the
 * canvas.
 *
 * Scenarios:
 *
 * 1. A mesh skin creates one `THREE.SkinnedMesh` with `skinIndex/skinWeight`
 *    attributes bound to the requested skeleton bones.
 * 2. A part with both `attachedBone` and skin data stays rigid under that bone,
 *    while a missing skin joint rejects with a targeted message.
 * 3. `applyExpression` drives both morph target dictionaries and imported
 *    expression sinks, with explicit ARKit channels overriding preset
 *    expansion.
 * 4. `AutoMoviePlayer.update` writes pose, expression, and imported-runtime frame
 *    hooks on the same timestamp; the pose root lands on a viewer-owned wrapper
 *    even for Group inputs, preserving the caller's baked transform (#1047),
 *    and a null-root pose returns to the staged base (#1046).
 * 5. `captureViewerSnapshot` renders exactly once and returns canvas metadata.
 *
 * @author Samchon
 */
export const test_viewer_production_asset_runtime = async (): Promise<void> => {
  const model = createProductionAssetModel();
  const built = buildModel(model);
  const skinned = collectSkinnedMeshes(built.object);
  TestValidator.equals("one skinned mesh", skinned.length, 1);
  TestValidator.equals(
    "skinned joints",
    skinned[0]!.skeleton.bones.map((b) => b.name),
    ["hips", "leftUpperArm"],
  );
  TestValidator.equals(
    "skin index item size",
    skinned[0]!.geometry.getAttribute("skinIndex").itemSize,
    4,
  );
  TestValidator.equals(
    "skin weight item size",
    skinned[0]!.geometry.getAttribute("skinWeight").itemSize,
    4,
  );

  const rigid = built.object.getObjectByName("rigid-with-skin");
  TestValidator.equals("rigid parent", rigid?.parent?.name, "leftHand");
  TestValidator.predicate(
    "missing skin bone rejects",
    throwsError(
      () =>
        buildModel(
          createProductionAssetModel({
            joints: ["hips", "rightFoot"],
          }),
        ),
      ["skin references missing bone", "rightFoot"],
    ),
  );

  const morph = createMorphMesh();
  const importedBone = new THREE.Object3D();
  const importedRoot = new THREE.Group();
  // a caller-baked transform (three-vrm's VRM0 π yaw) that pose roots must
  // never overwrite (#1047)
  importedRoot.rotateY(Math.PI);
  importedRoot.add(importedBone, morph);
  const expressionValues = new Map<string, number>();
  const frames: Array<{ seconds: number; deltaSeconds: number }> = [];
  const imported = createImportedModelObject({
    object: importedRoot,
    bones: { hips: importedBone },
    expressionTargets: [
      {
        setExpressionValue: (name, weight) =>
          expressionValues.set(name, weight),
      },
    ],
    afterAutoMovieFrame: ({ seconds, deltaSeconds }) =>
      frames.push({ seconds, deltaSeconds }),
  });
  const happy = expression("happy", 0.7, [
    { channel: "mouthSmileLeft", weight: 0.2 },
  ]);
  applyExpression(imported, happy);
  TestValidator.equals("preset morph", morph.morphTargetInfluences![0], 0.7);
  TestValidator.equals(
    "explicit channel override",
    morph.morphTargetInfluences![1],
    0.2,
  );
  TestValidator.equals(
    "preset expansion channel",
    morph.morphTargetInfluences![2],
    0.7,
  );
  TestValidator.equals(
    "non-expression morph preserved",
    morph.morphTargetInfluences![3],
    0.4,
  );
  TestValidator.equals("sink preset", expressionValues.get("happy"), 0.7);
  TestValidator.equals(
    "sink override",
    expressionValues.get("mouthSmileLeft"),
    0.2,
  );
  TestValidator.equals("sink reset", expressionValues.get("angry"), 0);

  const skeleton = singleBoneSkeleton();
  const pose: IAutoMoviePose = {
    skeleton: skeleton.id,
    root: {
      ...IDENTITY_TRANSFORM,
      translation: { x: 1.25, y: 0.5, z: -0.25 },
    },
    joints: [],
  };
  const player = new AutoMoviePlayer(
    imported,
    skeleton,
    makeMotion(
      [keyframe(0, pose, "linear", happy), keyframe(1, pose, "linear", happy)],
      1,
    ),
  );
  player.update(0.25);
  player.update(0.5);
  TestValidator.predicate(
    "root transform applied",
    nclose(imported.object.position.x, 1.25) &&
      nclose(imported.object.position.y, 0.5) &&
      nclose(imported.object.position.z, -0.25),
  );
  // even a Group input gets a viewer-owned wrapper (#1047): the pose root
  // landed on the wrapper, and the caller's baked π yaw survived beneath it
  TestValidator.predicate(
    "an imported Group is wrapped, its baked transform preserved",
    imported.object !== importedRoot &&
      nclose(Math.abs(importedRoot.quaternion.y), 1) &&
      nclose(importedRoot.quaternion.w, 0) &&
      nclose(importedRoot.position.x, 0),
  );
  TestValidator.equals("frame hook count", frames.length, 2);
  TestValidator.equals("first frame time", frames[0]!.seconds, 0.25);
  TestValidator.equals("first frame delta", frames[0]!.deltaSeconds, 0);
  TestValidator.equals("second frame delta", frames[1]!.deltaSeconds, 0.25);
  TestValidator.equals("last expression", player.lastExpression, happy);

  // a null-root pose returns the model to the node's staged base (#1046):
  // the engine defaults a null root to identity, so a gesture clip taking
  // over from a walk must not strand the model at the walk's destination
  player.setMotion(
    makeMotion(
      [
        keyframe(0, { skeleton: skeleton.id, root: null, joints: [] }),
        keyframe(1, { skeleton: skeleton.id, root: null, joints: [] }),
      ],
      1,
    ),
  );
  player.update(0.75);
  TestValidator.predicate(
    "a null root resets to the staged base, not the last rooted pose",
    nclose(imported.object.position.x, 0) &&
      nclose(imported.object.position.y, 0) &&
      nclose(imported.object.position.z, 0),
  );

  let renders = 0;
  const renderer: IAutoMovieViewerSnapshotRenderer = {
    render: () => {
      renders += 1;
    },
    domElement: {
      width: 32,
      height: 18,
      toDataURL: (mimeType, quality) => `${mimeType}:${quality}`,
    },
  };
  const snapshot = captureViewerSnapshot(
    renderer,
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
    { mimeType: "image/jpeg", quality: 0.8 },
  );
  TestValidator.equals("snapshot render count", renders, 1);
  TestValidator.equals("snapshot payload", snapshot, {
    width: 32,
    height: 18,
    mimeType: "image/jpeg",
    dataUrl: "image/jpeg:0.8",
  });
};

const collectSkinnedMeshes = (root: THREE.Object3D): THREE.SkinnedMesh[] => {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) out.push(object);
  });
  return out;
};

const createProductionAssetModel = (options?: {
  joints: ["hips", "leftUpperArm"] | ["hips", "rightFoot"];
}): IAutoMovieModel => {
  const skin = {
    joints: options?.joints ?? ["hips", "leftUpperArm"],
    boneIndices: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    weights: [1, 0, 0, 0, 1, 0, 0, 0, 0.25, 0.75, 0, 0],
  };
  return {
    ...createModel(createSkeleton()),
    origin: "imported",
    asset: "asset:gltf",
    parts: [
      {
        id: "skinned",
        name: "skinned",
        geometry: {
          type: "mesh",
          mesh: {
            positions: [0, 0, 0, 0, 1, 0, 1, 0, 0],
            normals: null,
            uvs: null,
            indices: [0, 1, 2],
            skin,
          },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
      {
        id: "rigid-with-skin",
        name: "rigid-with-skin",
        geometry: {
          type: "mesh",
          mesh: {
            positions: [0, 0, 0, 0, 0.25, 0, 0.25, 0, 0],
            normals: null,
            uvs: null,
            indices: [0, 1, 2],
            skin,
          },
        },
        material: null,
        attachedBone: "leftHand",
        transform: null,
      },
    ],
  };
};

const createMorphMesh = (): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3),
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.morphTargetDictionary = {
    happy: 0,
    mouthSmileLeft: 1,
    mouthSmileRight: 2,
    bodyWide: 3,
  };
  mesh.morphTargetInfluences = [0, 0, 0, 0.4];
  return mesh;
};

const expression = (
  preset: IAutoMovieExpression["preset"],
  intensity: number,
  blendshapes: IAutoMovieExpression["blendshapes"] = null,
): IAutoMovieExpression => ({ preset, intensity, blendshapes });

const singleBoneSkeleton = (): IAutoMovieSkeleton => ({
  id: "runtime",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: IDENTITY_TRANSFORM,
      constraint: null,
    },
  ],
});
