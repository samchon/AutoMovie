import { IAutoMovieClip, IAutoMovieTrack } from "@automovie/interface";
import { applyObjectMotion } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";

const node = (
  // The FULL node-channel union on purpose: a helper that cannot express
  // `weights` is how the fourth path stayed unapplied while a scenario claimed
  // to prove the mapping complete (#1357), the same shape that hid `scale`.
  path: "translation" | "rotation" | "scale" | "weights",
  values: number[],
): IAutoMovieTrack => ({
  channel: { kind: "node", node: "prop", path },
  times: [0, 1],
  values,
  interpolation: "linear",
});

/** A mesh carrying `count` morph targets, all resting at zero. */
const morphMesh = (count: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  mesh.morphTargetInfluences = Array.from({ length: count }, () => 0);
  return mesh;
};

/**
 * `applyObjectMotion` is the render side of the engine's clip bakers: every
 * node channel the engine composes must land on the `THREE.Object3D` the same
 * way. Scale used to fall through silently (#1049): a clip growing a prop 1→2
 * rendered rigid while every engine-side consumer (`sampleClip` width
 * validation, `resolveFrame` matrix composition) saw it at 1.5 mid-clip.
 *
 * `weights` was the last path still falling through (#1357): the gate accepted
 * such a track, `resolveFrame` interpolated it, and the render left the mesh
 * where it was, so a clip that morphs a prop validated clean and changed
 * nothing on screen.
 *
 * Scenarios:
 *
 * 1. Translation, rotation, AND scale tracks all write onto the resolved object at
 *    the sampled instant (t=0.5 of a 1s clip: position (1,2,3), the 45° slerped
 *    quaternion, scale 1.5).
 * 2. An unresolved node and a non-node (pointer) channel are skipped without
 *    touching anything or throwing.
 * 3. The documented carry-over contract: a channel absent from the clip keeps the
 *    object's existing value (the helper owns no rest poses: hosts that swap
 *    clips restore staged bases themselves).
 * 4. A `weights` track writes the sampled vector, by INDEX, onto every morphable
 *    mesh beneath the resolved object, including a nested one; the value is the
 *    interpolated midpoint, not either endpoint.
 * 5. Boundaries of that write: an object with no morphable mesh is skipped without
 *    throwing, a mesh with FEWER influences than the track is filled as far as
 *    it goes (a clip authored against another model), and a mesh with MORE
 *    keeps its untouched tail.
 */
export const test_viewer_apply_object_motion = (): void => {
  const s = Math.SQRT1_2;
  const clip: IAutoMovieClip = {
    id: "c",
    name: null,
    duration: 1,
    loop: false,
    tracks: [
      node("translation", [0, 0, 0, 2, 4, 6]),
      node("rotation", [0, 0, 0, 1, 0, s, 0, s]),
      node("scale", [1, 1, 1, 2, 2, 2]),
      {
        channel: { kind: "pointer", pointer: "/x", valueType: "scalar" },
        times: [0, 1],
        values: [0, 1],
        interpolation: "linear",
      },
      {
        channel: { kind: "node", node: "ghost", path: "translation" },
        times: [0, 1],
        values: [0, 0, 0, 9, 9, 9],
        interpolation: "linear",
      },
    ],
  };

  // 1. all three TRS channels write
  const prop = new THREE.Object3D();
  applyObjectMotion(clip, 0.5, (n) => (n === "prop" ? prop : undefined));
  const halfAngle = Math.PI / 8; // slerp(identity, 90°@Y, 0.5) = 45° about Y
  TestValidator.predicate(
    "translation, rotation, and scale all land on the object",
    nclose(prop.position.x, 1) &&
      nclose(prop.position.y, 2) &&
      nclose(prop.position.z, 3) &&
      nclose(prop.quaternion.y, Math.sin(halfAngle)) &&
      nclose(prop.quaternion.w, Math.cos(halfAngle)) &&
      nclose(prop.scale.x, 1.5) &&
      nclose(prop.scale.y, 1.5) &&
      nclose(prop.scale.z, 1.5),
  );

  // 2. unresolved node + pointer channel skipped (nothing throws, prop keeps
  //    its sampled state)
  TestValidator.predicate(
    "unresolved and non-node channels are skipped",
    nclose(prop.position.x, 1),
  );

  // 3. the carry-over contract: a scale-less clip leaves scale untouched
  const rigid: IAutoMovieClip = {
    ...clip,
    tracks: [node("translation", [0, 0, 0, 2, 4, 6])],
  };
  applyObjectMotion(rigid, 1, (n) => (n === "prop" ? prop : undefined));
  TestValidator.predicate(
    "a channel absent from the clip keeps the object's existing value",
    nclose(prop.position.x, 2) && nclose(prop.scale.x, 1.5),
  );

  // 4. weights land on every morphable mesh under the object, by index
  const morphs: IAutoMovieClip = {
    ...clip,
    tracks: [node("weights", [0, 0, 1, 0.5])],
  };
  const carrier = new THREE.Object3D();
  const direct = morphMesh(2);
  const nested = new THREE.Object3D();
  const buried = morphMesh(2);
  nested.add(buried);
  carrier.add(direct);
  carrier.add(nested);
  applyObjectMotion(morphs, 0.5, (n) => (n === "prop" ? carrier : undefined));
  TestValidator.predicate(
    "a weights track writes the sampled vector onto every morphable mesh",
    nclose(direct.morphTargetInfluences![0]!, 0.5) &&
      nclose(direct.morphTargetInfluences![1]!, 0.25) &&
      nclose(buried.morphTargetInfluences![0]!, 0.5) &&
      nclose(buried.morphTargetInfluences![1]!, 0.25),
  );

  // 5. BOUNDARIES: no morphable mesh, a shorter influence array, a longer one
  const bare = new THREE.Object3D();
  applyObjectMotion(morphs, 0.5, (n) => (n === "prop" ? bare : undefined));
  TestValidator.equals(
    "an object with no morphable mesh is skipped",
    bare.children.length,
    0,
  );
  const short = morphMesh(1);
  const long = morphMesh(3);
  long.morphTargetInfluences![2] = 0.9;
  const mixed = new THREE.Object3D();
  mixed.add(short);
  mixed.add(long);
  applyObjectMotion(morphs, 0.5, (n) => (n === "prop" ? mixed : undefined));
  TestValidator.predicate(
    "a shorter influence array fills as far as it goes and a longer one keeps its tail",
    short.morphTargetInfluences!.length === 1 &&
      nclose(short.morphTargetInfluences![0]!, 0.5) &&
      nclose(long.morphTargetInfluences![0]!, 0.5) &&
      nclose(long.morphTargetInfluences![1]!, 0.25) &&
      nclose(long.morphTargetInfluences![2]!, 0.9),
  );
};
